'use client';

/**
 * HotelResultsView — PURE, image-capable hotel results list (PR-H2; COMPACT-1
 * converted the photo-card scroller to dense list rows).
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
 * PURE VIEW for actions too: the `Book` button calls onBook(hotel); when the
 * container wires onSave, each card also shows a "Save to trip" button calling
 * onSave(hotel). The view never books or saves itself — the container decides what
 * each action does (guest checkout, sign-up nudge, or a budget commit).
 */

import { useState } from 'react';
import ResultsFilterBar from './ResultsFilterBar';
import { sortAndFilterResults, type SortKey } from '@/lib/resultsSortFilter';

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
  /** Optional: save the stay to the selected trip's budget (the home Travel tab
   *  wires this). Consumers that omit it simply show no "Save to trip" button —
   *  additive, so existing callers are unaffected. */
  onSave?: (hotel: HotelResult) => void;
  /** The hotel id currently being saved — its Save button shows a pending state. */
  savingId?: string | null;
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

/** Per-row thumbnail: shows the photo when present + loadable, else a neutral
 *  placeholder block. NEVER a broken <img> — a present-but-404 URL flips to the
 *  same placeholder via onError (local UI state, not data loading). COMPACT-1:
 *  fills its parent (the row's fixed h-14 w-20 cell) instead of a 4/3 card face. */
function HotelCardImage({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photoUrl && !failed;

  return (
    <div className="relative h-full w-full overflow-hidden bg-white/5">
      {showPhoto ? (
        <img
          src={photoUrl as string}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        // Neutral placeholder — not a broken image icon.
        <div className="flex h-full w-full items-center justify-center text-white/40">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-2" />
            <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
          </svg>
        </div>
      )}
    </div>
  );
}

function RatingPill({ hotel }: { hotel: HotelResult }) {
  // Prefer the 0–10 guest score; else the 0–5 star/rating. Nothing if neither.
  // COMPACT-1: an inline chip in the row (no photo to overlay anymore).
  const has10 = typeof hotel.reviewScore === 'number' && hotel.reviewScore > 0;
  const has5 = hotel.googleRating > 0;
  if (!has10 && !has5) return null;
  const label = has10 ? hotel.reviewScore!.toFixed(1) : hotel.googleRating.toFixed(1);
  const scale = has10 ? '/10' : '/5';
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white">
      <span className="text-brand-amber" aria-hidden="true">★</span>
      {label}
      <span className="font-normal text-white/40">{scale}</span>
    </span>
  );
}

export default function HotelResultsView({ results, loading, error, onBook, onSave, savingId }: Props) {
  // Client-side sort/filter over the already-fetched results — NO refetch.
  const [sort, setSort] = useState<SortKey>('price-asc');
  const [minRating, setMinRating] = useState(0);

  if (loading) {
    // COMPACT-1: skeleton rows, matching the dense list-row result layout.
    return (
      <div className="divide-y divide-panel-border rounded-lg border border-panel-border bg-panel-surface" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="h-14 w-20 shrink-0 animate-pulse rounded bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
            </div>
            <div className="h-7 w-16 shrink-0 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel-surface p-3 text-sm text-brand-red">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-panel-border bg-panel-surface p-4 text-center">
        <p className="text-sm font-medium text-white">No hotels yet</p>
        <p className="mt-1 text-xs text-white/50">
          Enter a city, country, and your dates to see real stays with photos and nightly prices.
        </p>
      </div>
    );
  }

  // Per-view accessors: hotels sort on per-night (fallback total/whole price) +
  // the 0–5 googleRating. sortAndFilterResults returns a NEW array (no refetch).
  const displayed = sortAndFilterResults(
    results,
    { sort, minRating },
    {
      getPrice: (h) => h.pricePerNight ?? h.priceTotal ?? h.price,
      getRating: (h) => h.googleRating,
    },
  );

  return (
    <div>
      <ResultsFilterBar
        sort={sort}
        minRating={minRating}
        onSortChange={setSort}
        onMinRatingChange={setMinRating}
        shownCount={displayed.length}
        totalCount={results.length}
      />
      {displayed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-panel-border bg-panel-surface p-4 text-center text-sm text-white/50">
          No results match these filters.
        </div>
      ) : (
        // COMPACT-1: dense list rows (thumbnail · name/place · price · actions),
        // replacing the horizontal photo-card scroller.
        <div
          aria-label="Hotel results"
          className="divide-y divide-panel-border rounded-lg border border-panel-border bg-panel-surface"
        >
          {displayed.map((hotel, idx) => {
        // Per-night first (the number travelers compare on); total as support.
        const perNight = hotel.pricePerNight;
        const total = hotel.priceTotal ?? hotel.price ?? null;
        const nights = hotel.nights;
        const place = hotel.city || hotel.address;

        return (
          <div
            key={`${hotel.liteapiHotelId}-${idx}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2 transition-colors hover:bg-panel-hover sm:flex-nowrap"
          >
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded">
              <HotelCardImage photoUrl={hotel.photoUrl} name={hotel.name} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h3 className="truncate text-sm font-medium text-white" title={hotel.name}>
                  {hotel.name}
                </h3>
                <RatingPill hotel={hotel} />
              </div>
              {place && (
                <p className="mt-0.5 truncate text-xs text-white/50">{place}</p>
              )}
            </div>

            {/* Price block — per-night prominent, total + nights as support. */}
            <div className="shrink-0 text-right">
              {typeof perNight === 'number' ? (
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-sm font-bold text-brand-green">
                    {money(perNight, hotel.currency)}
                  </span>
                  <span className="text-[10px] text-white/50">/ night</span>
                </div>
              ) : total != null ? (
                <div className="text-sm font-bold text-brand-green">
                  {money(total, hotel.currency)}
                </div>
              ) : (
                <div className="text-xs text-white/40">Price on request</div>
              )}
              {total != null && (
                <div className="text-[10px] text-white/40">
                  {money(total, hotel.currency)} total
                  {typeof nights === 'number' && nights > 0 ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onBook(hotel)}
                className="rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
              >
                Book
              </button>
              {/* PR-Hotel-Commit: a second action — save the stay to a trip's budget
                  (plan), separate from "Book" (pay now). Only shown when the container
                  wires onSave (the home Travel tab). */}
              {onSave && (
                <button
                  type="button"
                  onClick={() => onSave(hotel)}
                  disabled={savingId === hotel.liteapiHotelId}
                  className="rounded border border-brand-purple bg-white px-3 py-1.5 text-xs font-semibold text-brand-purple transition-colors hover:bg-bg-row disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                >
                  {savingId === hotel.liteapiHotelId ? 'Saving…' : 'Save to trip'}
                </button>
              )}
            </div>
          </div>
        );
          })}
        </div>
      )}
    </div>
  );
}
