'use client';

/**
 * ActivityResultsView — PURE, image-capable activity results list (PR-A2;
 * COMPACT-1 converted the photo-card scroller to dense list rows).
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

/** Per-row thumbnail: shows the photo when present + loadable, else a neutral
 *  placeholder block. NEVER a broken <img> — a present-but-404 URL flips to the
 *  same placeholder via onError (local UI state, not data loading). COMPACT-1:
 *  fills its parent (the row's fixed h-14 w-20 cell) instead of a 4/3 card face. */
function ActivityCardImage({ photoUrl, name }: { photoUrl: string | null; name: string }) {
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
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
      )}
    </div>
  );
}

function RatingPill({ activity }: { activity: ActivityResult }) {
  // COMPACT-1: an inline chip in the row (no photo to overlay anymore).
  if (activity.googleRating <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white">
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
        <p className="text-sm font-medium text-white">No activities yet</p>
        <p className="mt-1 text-xs text-white/50">
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
        <div className="rounded-lg border border-dashed border-panel-border bg-panel-surface p-4 text-center text-sm text-white/50">
          No results match these filters.
        </div>
      ) : (
        // COMPACT-1: dense list rows (thumbnail · name/meta · price · action),
        // replacing the horizontal photo-card scroller.
        <div
          aria-label="Activity results"
          className="divide-y divide-panel-border rounded-lg border border-panel-border bg-panel-surface"
        >
          {displayed.map((activity, idx) => {
        const duration = formatDuration(activity.durationMinutes);
        const place = activity.address;

        return (
          <div
            key={`${activity.viatorProductCode || activity.name}-${idx}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2 transition-colors hover:bg-panel-hover sm:flex-nowrap"
          >
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded">
              <ActivityCardImage photoUrl={activity.photoUrl} name={activity.name} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h3 className="truncate text-sm font-medium text-white" title={activity.name}>
                  {activity.name}
                </h3>
                <RatingPill activity={activity} />
              </div>

              {/* Meta row: place + duration chip. */}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/50">
                {place && <span className="truncate">{place}</span>}
                {duration && (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                    {duration}
                  </span>
                )}
              </div>
            </div>

            {/* Price — "From $X". Mirrors the hotel row's green price emphasis. */}
            <div className="shrink-0 text-right">
              {typeof activity.price === 'number' ? (
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-[10px] text-white/50">From</span>
                  <span className="text-sm font-bold text-brand-green">{money(activity.price)}</span>
                </div>
              ) : (
                <div className="text-xs text-white/40">Price on request</div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onBook(activity)}
              className="shrink-0 rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              Book
            </button>
          </div>
        );
          })}
        </div>
      )}
    </div>
  );
}
