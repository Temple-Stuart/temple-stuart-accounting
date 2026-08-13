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
 * AFFILIATE LOCK — REVERSED FOR ACTIVITIES (PR-CHIP-1, Alex's ruling,
 * 2026-08-03; supersedes the original lock): when a result CARRIES a
 * `bookingUrl` (emitted only by the activities route, and only after its
 * viator.com + pid validation), Book renders as a real outbound
 * <a target="_blank" rel="noopener noreferrer sponsored"> — the guest-
 * completable booking. The view still NEVER CONSTRUCTS a URL from the product
 * code — it renders exactly the validated field or nothing. Results without a
 * bookingUrl keep the old behavior: the optional onBook callback, or — for
 * rails with no vendor at all (ground, PR-CHIP-1 ruling 2) — the honest
 * disabled `bookDisabledLabel` instead of a fake CTA.
 */

import { useState } from 'react';
import ResultsFilterBar from './ResultsFilterBar';
import { sortAndFilterResults, type SortKey } from '@/lib/resultsSortFilter';
// TRAVEL-RESULTS-TABLE: the results wear the deck-table anatomy — the
// DATA.columnHeader micro-label is the one shared class string (ds.ts:225).
import { DATA } from '@/lib/ds';

/** The fields this view renders off a PR-A1 result item — the
 *  viatorProductToRecommendation shape minus `website` (still stripped).
 *  PR-CHIP-1: `bookingUrl` is OPTIONAL — present only on activities results
 *  that passed the route's viator.com + pid affiliate validation; transfers
 *  results never carry it (their route still strips). */
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
  /** Validated Viator affiliate URL (activities only) — rendered verbatim as
   *  the Book link when present; never constructed here. */
  bookingUrl?: string | null;
}

interface Props {
  results: ActivityResult[];
  loading: boolean;
  error: string;
  /** Fallback Book action for results WITHOUT a bookingUrl (e.g. the container
   *  routes it to sign-up). Optional since PR-CHIP-1 — a container may instead
   *  pass bookDisabledLabel when no booking path exists at all. */
  onBook?: (activity: ActivityResult) => void;
  /** PR-CHIP-1 (ruling 2): when set, URL-less results render this DISABLED
   *  honest label instead of a Book action — for rails with no vendor wired
   *  (ground). Takes precedence over onBook. */
  bookDisabledLabel?: string;
  /** TRAVEL-RESULTS-TABLE: the quiet mono caption above the table — mode +
   *  vendor, SUPPLIED BY THE MOUNT (the providerLabel no-drift precedent,
   *  FlightPickerView :106-110): this view is shared by the activities AND
   *  transfers rails (both Viator-served — activities/search/route.ts:3,
   *  transfers/search/route.ts:3 — but different modes), so the view cannot
   *  know its own mode word. Absent → no caption renders (never guessed). */
  caption?: string;
}

/** Route-side result cap shared by BOTH consumers of this view — the
 *  activities + transfers search routes each slice to 12
 *  (ACTIVITY_MAX_RESULTS, activities/search/route.ts; TRANSFER_MAX_RESULTS,
 *  transfers/search/route.ts). Disclosed in the filter bar when a full page
 *  arrives (PR-CHIP-1 ruling 3); fewer than 12 = the complete result set, so
 *  nothing is disclosed (an un-truncated list labeled "Top 12" would lie). */
const ROUTE_RESULT_CAP = 12;

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
    <div className="relative h-full w-full overflow-hidden bg-bg-row">
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
        <div className="flex h-full w-full items-center justify-center text-text-faint">
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
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-row px-1.5 py-0.5 text-[10px] font-semibold text-text-primary">
      <span className="text-brand-amber" aria-hidden="true">★</span>
      {activity.googleRating.toFixed(1)}
      {activity.reviewCount > 0 && (
        <span className="font-normal text-text-faint">({activity.reviewCount.toLocaleString()})</span>
      )}
    </span>
  );
}

export default function ActivityResultsView({ results, loading, error, onBook, bookDisabledLabel, caption }: Props) {
  // Client-side sort/filter over the already-fetched results — NO refetch.
  const [sort, setSort] = useState<SortKey>('price-asc');
  const [minRating, setMinRating] = useState(0);

  if (loading) {
    // COMPACT-1: skeleton rows, matching the dense list-row result layout.
    return (
      <div className="divide-y divide-border rounded-lg border border-border bg-white" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="h-14 w-20 shrink-0 animate-pulse rounded bg-bg-row" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 animate-pulse rounded bg-bg-row" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-bg-row" />
            </div>
            <div className="h-7 w-16 shrink-0 animate-pulse rounded bg-bg-row" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-white p-3 text-sm text-brand-red">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-4 text-center">
        <p className="text-sm font-medium text-text-primary">No activities yet</p>
        <p className="mt-1 text-xs text-text-faint">
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
        capNote={results.length >= ROUTE_RESULT_CAP ? `Top ${ROUTE_RESULT_CAP} results` : undefined}
      />
      {displayed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-4 text-center text-sm text-text-faint">
          No results match these filters.
        </div>
      ) : (
        // TRAVEL-RESULTS-TABLE (spec design-refs/landing-direction-c.dc.html
        // :100-170 — the 01-demo table anatomy): mono column headers on
        // bg-bg-row, hairline rows, zebra, wash hover; prices gold right-mono.
        // Columns are the REAL result fields (ActivityResult :38-53):
        // thumbnail · name/place · rating · duration · from-price · action —
        // every field the COMPACT-1 rows rendered still renders (field
        // parity). The caption is mount-supplied (see the Props note). The
        // PR-CHIP-1 action precedence block is byte-identical.
        <div>
          {caption && (
            <div className="mb-1 font-mono text-[10px] tracking-wider text-text-faint">{caption}</div>
          )}
          <div className="overflow-x-auto rounded-lg border border-border bg-white" aria-label="Activity results">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-row text-left">
                  <th className="px-2 py-2"><span className="sr-only">Photo</span></th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Activity</th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Rating</th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Duration</th>
                  <th className={`px-3 py-2 text-right font-semibold ${DATA.columnHeader}`}>From</th>
                  <th className="px-3 py-2"><span className="sr-only">Book</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayed.map((activity, idx) => {
                  const duration = formatDuration(activity.durationMinutes);
                  const place = activity.address;

                  return (
                    <tr
                      key={`${activity.viatorProductCode || activity.name}-${idx}`}
                      className="odd:bg-bg-row transition-colors hover:bg-brand-purple-wash/40"
                    >
                      <td className="px-2 py-2">
                        <div className="h-14 w-20 overflow-hidden rounded">
                          <ActivityCardImage photoUrl={activity.photoUrl} name={activity.name} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <h3 className="max-w-[16rem] truncate text-sm font-medium text-brand-purple" title={activity.name}>
                          {activity.name}
                        </h3>
                        {place && (
                          <p className="mt-0.5 max-w-[16rem] truncate text-xs text-text-faint">{place}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <RatingPill activity={activity} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {duration && (
                          <span className="text-xs text-text-secondary">{duration}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {typeof activity.price === 'number' ? (
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-[10px] text-text-faint">From</span>
                            <span className="font-mono text-sm font-semibold text-brand-gold">{money(activity.price)}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-text-faint">Price on request</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {/* PR-CHIP-1 action precedence: validated affiliate URL → real
                            outbound Book link; no URL + bookDisabledLabel → honest disabled
                            label (no vendor exists); no URL + onBook → legacy callback. */}
                        {activity.bookingUrl ? (
                          <a
                            href={activity.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            className="shrink-0 rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                          >
                            Book
                          </a>
                        ) : bookDisabledLabel ? (
                          <span
                            aria-disabled="true"
                            className="shrink-0 cursor-default rounded bg-bg-row px-3 py-1.5 text-xs font-medium text-text-faint"
                          >
                            {bookDisabledLabel}
                          </span>
                        ) : onBook ? (
                          <button
                            type="button"
                            onClick={() => onBook(activity)}
                            className="shrink-0 rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                          >
                            Book
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
