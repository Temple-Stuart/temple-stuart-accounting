'use client';

/**
 * HotelResultsView — PURE, image-capable hotel results grid (PR-H2).
 *
 * Renders the image-rich results returned by the PUBLIC hotel search route
 * (PR-H1, /api/travel/hotels/search → { results, count }). Each result is the
 * liteApiHotelToRecommendation shape (liteapiClient.ts:328): photoUrl/images,
 * name, googleRating/reviewScore, price/priceTotal/pricePerNight/nights, and the
 * liteapiHotelId/liteapiOfferId booking ids. HotelPicker has no image field
 * (HotelPicker.tsx:5-18) — this is the new image-capable surface the audit flagged.
 *
 * PURE VIEW: props only. NO fetch, NO context, NO data-loading useEffect. PR-H3's
 * container does the searching and feeds `results` + `onBook` down. The single bit
 * of local state is a per-card image-error fallback (UI only, not data) so a URL
 * that 404s degrades to the neutral placeholder instead of a broken <img>.
 *
 * SEARCH is public; BOOKING is gated — this view never books. The `Book` button
 * calls the onBook(hotel) callback prop; the container routes that to sign-up.
 */

import { useState } from 'react';
import HorizontalScroller from './HorizontalScroller';

/** The fields this view renders off a PR-H1 result item. Typed against the
 *  liteApiHotelToRecommendation shape (liteapiClient.ts:328-389); kept local
 *  because that interface isn't exported (and the route returns it unnamed). */
export interface HotelResult {
  name: string;
  address: string;
  city?: string;
  photoUrl: string | null;
  images?: string[];
  googleRating: number;        // 0–5
  reviewScore?: number;        // 0–10
  reviewCount?: number;
  price: number | null;        // whole-stay total
  priceTotal?: number;
  pricePerNight?: number;
  nights?: number;
  currency?: string;
  priceLevelDisplay: string | null;
  liteapiHotelId: string;
  liteapiOfferId: string | null;
}

interface Props {
  results: HotelResult[];
  loading: boolean;
  error: string;
  /** Booking is gated — the view never books. The container routes this to
   *  sign-up (guests) or the authed commit flow. */
  onBook: (hotel: HotelResult) => void;
}

function money(amount: number, currency?: string): string {
  const code = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: code, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

/** Per-card image: shows the photo when present + loadable, else a neutral
 *  placeholder block. NEVER a broken <img> — a present-but-404 URL flips to the
 *  same placeholder via onError (local UI state, not data loading). */
function HotelCardImage({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photoUrl && !failed;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-bg-row">
      {showPhoto ? (
        <img
          src={photoUrl as string}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        // Neutral placeholder — not a broken image icon.
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-faint">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-2" />
            <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
          </svg>
          <span className="text-[11px]">No photo</span>
        </div>
      )}
    </div>
  );
}

function RatingPill({ hotel }: { hotel: HotelResult }) {
  // Prefer the 0–10 guest score; else the 0–5 star/rating. Nothing if neither.
  const has10 = typeof hotel.reviewScore === 'number' && hotel.reviewScore > 0;
  const has5 = hotel.googleRating > 0;
  if (!has10 && !has5) return null;
  const label = has10 ? hotel.reviewScore!.toFixed(1) : hotel.googleRating.toFixed(1);
  const scale = has10 ? '/10' : '/5';
  return (
    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold text-text-primary shadow-sm backdrop-blur">
      <span className="text-brand-amber" aria-hidden="true">★</span>
      {label}
      <span className="font-normal text-text-faint">{scale}</span>
    </span>
  );
}

export default function HotelResultsView({ results, loading, error, onBook }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="aspect-[4/3] w-full animate-pulse bg-bg-row" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-bg-row" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-bg-row" />
              <div className="h-8 w-full animate-pulse rounded bg-bg-row" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 text-sm text-brand-red">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center">
        <p className="text-sm font-medium text-text-primary">No hotels yet</p>
        <p className="mt-1 text-sm text-text-muted">
          Enter a city, country, and your dates to see real stays with photos and nightly prices.
        </p>
      </div>
    );
  }

  return (
    <HorizontalScroller ariaLabel="Hotel results">
      {results.map((hotel, idx) => {
        // Per-night first (the number travelers compare on); total as support.
        const perNight = hotel.pricePerNight;
        const total = hotel.priceTotal ?? hotel.price ?? null;
        const nights = hotel.nights;
        const place = hotel.city || hotel.address;

        return (
          <article
            key={`${hotel.liteapiHotelId}-${idx}`}
            className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="relative">
              <HotelCardImage photoUrl={hotel.photoUrl} name={hotel.name} />
              <RatingPill hotel={hotel} />
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-1 font-medium text-text-primary" title={hotel.name}>
                {hotel.name}
              </h3>
              {place && (
                <p className="mt-0.5 line-clamp-1 text-sm text-text-muted">{place}</p>
              )}

              {/* Price block — per-night prominent, total + nights as support. */}
              <div className="mt-3">
                {typeof perNight === 'number' ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-brand-green">
                      {money(perNight, hotel.currency)}
                    </span>
                    <span className="text-xs text-text-muted">/ night</span>
                  </div>
                ) : total != null ? (
                  <div className="text-lg font-bold text-brand-green">
                    {money(total, hotel.currency)}
                  </div>
                ) : (
                  <div className="text-sm text-text-faint">Price on request</div>
                )}
                {total != null && (
                  <div className="text-xs text-text-faint">
                    {money(total, hotel.currency)} total
                    {typeof nights === 'number' && nights > 0 ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onBook(hotel)}
                className="mt-4 w-full rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
              >
                Book
              </button>
            </div>
          </article>
        );
      })}
    </HorizontalScroller>
  );
}
