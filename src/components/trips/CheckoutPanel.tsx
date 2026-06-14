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
  rating?: number;        // 0–10 guest score (probe-confirmed)
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

export default function CheckoutPanel({ tripId, offerId, hotelId, images, hotelName, checkin, checkout, onClose }: Props) {
  const [phase, setPhase] = useState<'prebooking' | 'pay'>('prebooking');
  const [error, setError] = useState('');
  const [prebook, setPrebook] = useState<Prebook | null>(null);
  const [paymentEnv, setPaymentEnv] = useState<'live' | 'sandbox' | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [started, setStarted] = useState(false); // guard: init the SDK once

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
                      <span><span className="font-semibold text-text-primary">{content.rating}</span>/10{content.reviewCount ? ` · ${content.reviewCount.toLocaleString()} reviews` : ''}</span>
                    )}
                  </div>
                )}
                {(content.address || content.city) && (
                  <p className="text-xs text-text-muted">{[content.address, content.city].filter(Boolean).join(', ')}</p>
                )}
                {facilityNames.length > 0 && (
                  <p className="text-xs text-text-muted">{facilityNames.slice(0, 6).join(' · ')}{facilityNames.length > 6 ? ` · +${facilityNames.length - 6} more` : ''}</p>
                )}
                {description && <p className="line-clamp-4 text-sm text-text-secondary">{description}</p>}
              </div>
            )}
            {contentLoading && !content && <p className="text-xs text-text-muted">Loading hotel details…</p>}
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
                  <p className="mt-1 text-xs text-text-muted">Cancellation deadlines apply — see the hotel terms below.</p>
                )}
                {hotelRemarks.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                    {hotelRemarks.slice(0, 4).map((r, i) => <li key={i}>{stripHtml(r)}</li>)}
                  </ul>
                )}
              </div>
            )}
            {importantInfo && (
              <div className="text-xs text-text-muted">
                <button type="button" onClick={() => setShowTerms((v) => !v)} className="font-medium text-brand-purple underline">
                  {showTerms ? 'Hide' : 'Show'} hotel terms &amp; important info
                </button>
                {showTerms && <p className="mt-1 whitespace-pre-line">{importantInfo}</p>}
              </div>
            )}

            {/* 4. REVIEWS — render only non-empty headline/pros/cons; honest empty. */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Guest reviews</p>
              {reviewsLoading && !reviews && <p className="text-xs text-text-muted">Loading reviews…</p>}
              {reviewsError && <p className="text-xs text-text-faint">Couldn&apos;t load reviews.</p>}
              {reviews && reviews.length === 0 && <p className="text-xs text-text-muted">No reviews yet.</p>}
              {reviews && reviews.slice(0, 5).map((r, i) => (
                <div key={i} className="rounded border border-border bg-bg-row p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">{r.name?.trim() || 'Guest'}{r.country ? ` · ${r.country.toUpperCase()}` : ''}</span>
                    {r.averageScore != null && <span className="font-semibold text-brand-green">{r.averageScore}/10</span>}
                  </div>
                  {r.headline?.trim() && <p className="mt-0.5 font-medium text-text-secondary">{r.headline.trim()}</p>}
                  {r.pros?.trim() && <p className="mt-0.5 text-text-muted">+ {r.pros.trim()}</p>}
                  {r.cons?.trim() && <p className="text-text-muted">− {r.cons.trim()}</p>}
                  {r.date?.trim() && <p className="mt-0.5 text-text-faint">{r.date.slice(0, 10)}</p>}
                </div>
              ))}
            </div>
          </div>
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
