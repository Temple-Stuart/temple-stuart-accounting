'use client';

/**
 * ActivityResultsView — PURE, image-capable activity results grid (PR-A2).
 *
 * Renders the image-rich results from the PUBLIC activity search route (PR-A1,
 * /api/travel/activities/search → { results, count }). Each result is the
 * viatorProductToRecommendation shape with the affiliate-URL fields ALREADY
 * STRIPPED at the route (route.ts:76 drops `bookingUrl` + `website`). This view
 * mirrors HotelResultsView (same photo-card look + placeholder fallback).
 *
 * PURE VIEW: props only. NO fetch, NO context, NO data-loading useEffect. PR-A3's
 * container does the searching and feeds `results` + `onBook` down. The single bit
 * of local state is a per-card image-error fallback (UI only, not data).
 *
 * AFFILIATE LOCK: Viator "booking" is an external affiliate URL. This view must
 * NEVER render an <a href> to a booking/affiliate/viator.com URL, and must NOT
 * construct one from the product code. "Book" is a CALLBACK ONLY — onBook(activity)
 * — which the container routes to sign-up. No outbound link leaves this component.
 */

import { useState } from 'react';
import HorizontalScroller from './HorizontalScroller';
import ResultsFilterBar from './ResultsFilterBar';
import { sortAndFilterResults, type SortKey } from '@/lib/resultsSortFilter';

/** The fields this view renders off a PR-A1 result item — the
 *  viatorProductToRecommendation shape MINUS the stripped affiliate fields
 *  (`bookingUrl` + `website`, dropped at route.ts:76). Kept local; deliberately
 *  has no booking/affiliate URL field so the view cannot render one. */
export interface ActivityResult {
  name: string;
  address: string;
  photoUrl: string | null;
  priceLevelDisplay: string | null;
  googleRating: number;        // 0–5
  reviewCount: number;
  summary: string;
  category: string;
  viatorProductCode: string;
  durationMinutes: number | null;
  price: number | null;        // from-price in USD
}

interface Props {
  results: ActivityResult[];
  loading: boolean;
  error: string;
  /** Booking is gated — the view never books or links out. The container routes
   *  this to sign-up. NO affiliate URL is ever rendered here. */
  onBook: (activity: ActivityResult) => void;
}

function money(amount: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

/** Human-readable duration from minutes: "45 min" / "3h" / "1h 30m". */
function formatDuration(min: number | null): string | null {
  if (typeof min !== 'number' || min < 1) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/** Per-card image: shows the photo when present + loadable, else a neutral
 *  placeholder block. NEVER a broken <img> — a present-but-404 URL flips to the
 *  same placeholder via onError (local UI state, not data loading). */
function ActivityCardImage({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photoUrl && !failed;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/5">
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
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/40">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="text-[11px]">No photo</span>
        </div>
      )}
    </div>
  );
}

function RatingPill({ activity }: { activity: ActivityResult }) {
  if (activity.googleRating <= 0) return null;
  return (
    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/20 bg-panel/90 px-2 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur">
      <span className="text-brand-amber" aria-hidden="true">★</span>
      {activity.googleRating.toFixed(1)}
      {activity.reviewCount > 0 && (
        <span className="font-normal text-white/40">({activity.reviewCount.toLocaleString()})</span>
      )}
    </span>
  );
}

export default function ActivityResultsView({ results, loading, error, onBook }: Props) {
  // Client-side sort/filter over the already-fetched results — NO refetch.
  const [sort, setSort] = useState<SortKey>('price-asc');
  const [minRating, setMinRating] = useState(0);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-panel-border bg-panel-surface">
            <div className="aspect-[4/3] w-full animate-pulse bg-white/10" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
              <div className="h-8 w-full animate-pulse rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel-surface p-6 text-sm text-brand-red">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-panel-border bg-panel-surface p-8 text-center">
        <p className="text-sm font-medium text-white">No activities yet</p>
        <p className="mt-1 text-sm text-white/50">
          Enter a city and country to see real tours and experiences with photos and prices.
        </p>
      </div>
    );
  }

  // Per-view accessors: activities sort on the from-price + the 0–5 googleRating.
  // sortAndFilterResults returns a NEW array (no refetch).
  const displayed = sortAndFilterResults(
    results,
    { sort, minRating },
    {
      getPrice: (a) => a.price,
      getRating: (a) => a.googleRating,
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
        <div className="rounded-lg border border-dashed border-panel-border bg-panel-surface p-6 text-center text-sm text-white/50">
          No results match these filters.
        </div>
      ) : (
        <HorizontalScroller ariaLabel="Activity results">
          {displayed.map((activity, idx) => {
        const duration = formatDuration(activity.durationMinutes);
        const place = activity.address;

        return (
          <article
            key={`${activity.viatorProductCode || activity.name}-${idx}`}
            className="group flex flex-col overflow-hidden rounded-lg border border-panel-border bg-panel-surface transition-colors hover:bg-panel-hover"
          >
            <div className="relative">
              <ActivityCardImage photoUrl={activity.photoUrl} name={activity.name} />
              <RatingPill activity={activity} />
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-2 font-medium text-white" title={activity.name}>
                {activity.name}
              </h3>

              {/* Meta row: place + duration chip. */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/50">
                {place && <span className="line-clamp-1">{place}</span>}
                {duration && (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                    {duration}
                  </span>
                )}
              </div>

              {/* Price — "From $X". Mirrors the hotel card's green price emphasis. */}
              <div className="mt-3">
                {typeof activity.price === 'number' ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-white/50">From</span>
                    <span className="text-lg font-bold text-brand-green">{money(activity.price)}</span>
                  </div>
                ) : (
                  <div className="text-sm text-white/40">Price on request</div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onBook(activity)}
                className="mt-4 w-full rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
              >
                Book
              </button>
            </div>
          </article>
        );
          })}
        </HorizontalScroller>
      )}
    </div>
  );
}
